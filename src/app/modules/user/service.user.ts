import httpStatus from 'http-status';
import AppError from '../../errors/AppErrors';
import { User } from '../auth/model.auth';
import { TUser, TUserRole } from '../auth/interface.auth';
import { ActivityService } from '../activity/service.activity';

// ── Create Staff/Admin Account ──────────────────────────────────────────────────
const createStaff = async (
    payload: Pick<TUser, 'username' | 'email' | 'password' | 'contactNumber' | 'profilePicture'> & {
        role?: 'staff' | 'admin';
    },
    requesterId: string,
    requesterRole: TUserRole,
) => {
    // Only superAdmin can create an account with the 'admin' role directly.
    if (payload.role === 'admin' && requesterRole !== 'superAdmin') {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'Only a superAdmin can promote an account to admin.',
            'Role escalation not allowed',
        );
    }

    const user = await User.create({
        ...payload,
        role: payload.role ?? 'staff',
        createdBy: requesterId,
    });

    await ActivityService.createLog({
        type: 'user',
        message: `Staff account "${user.username}" (${user.role}) created`,
        metadata: { additionalInfo: user._id?.toString() },
    });

    const { password: _password, ...safeUser } = user.toObject();
    return safeUser;
};

// ── Get All Users ────────────────────────────────────────────────────────────────
const getAllUsers = async (query: Record<string, unknown>) => {
    const { search, role, page = 1, limit = 20 } = query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (role) filter.role = role;
    if (search) {
        const term = search as string;
        filter.$or = [
            { username: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
        ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [users, total] = await Promise.all([
        User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
        User.countDocuments(filter),
    ]);

    return {
        meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        data: users,
    };
};

// ── Get Single User ───────────────────────────────────────────────────────────────
const getUserById = async (userId: string) => {
    const user = await User.findById(userId).select('-password');
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found', 'User not found');
    }
    return user;
};

// ── Update User ───────────────────────────────────────────────────────────────────
const updateUser = async (
    userId: string,
    payload: Partial<Pick<TUser, 'username' | 'email' | 'contactNumber' | 'profilePicture' | 'role'>>,
    requesterRole: TUserRole,
) => {
    // Only superAdmin can change roles at all (promote to admin, demote, etc.)
    if (payload.role && requesterRole !== 'superAdmin') {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'Only a superAdmin can change a user\'s role.',
            'Role escalation not allowed',
        );
    }

    const updated = await User.findByIdAndUpdate(userId, payload, {
        new: true,
        runValidators: true,
    }).select('-password');

    if (!updated) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found', 'User not found');
    }

    await ActivityService.createLog({
        type: 'user',
        message: `Account "${updated.username}" updated`,
        metadata: { additionalInfo: updated._id?.toString() },
    });

    return updated;
};

// ── Deactivate User ────────────────────────────────────────────────────────────────
const deactivateUser = async (userId: string) => {
    const updated = await User.findByIdAndUpdate(
        userId,
        { isBlocked: true },
        { new: true },
    ).select('-password');

    if (!updated) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found', 'User not found');
    }

    await ActivityService.createLog({
        type: 'user',
        message: `Account "${updated.username}" deactivated`,
        metadata: { additionalInfo: updated._id?.toString() },
    });

    return updated;
};

export const userServices = {
    createStaff,
    getAllUsers,
    getUserById,
    updateUser,
    deactivateUser,
};
