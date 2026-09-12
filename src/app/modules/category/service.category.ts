import httpStatus from 'http-status';
import AppError from '../../errors/AppErrors';
import { TCategory } from './interface.category';
import { Category } from './model.category';

// Create category
const createCategory = async (payload: TCategory) => {
  // Check for duplicate name (case-insensitive)
  const existingName = await Category.findOne({
    name: { $regex: `^${payload.name}$`, $options: 'i' },
  });
  if (existingName) {
    throw new AppError(
      httpStatus.CONFLICT,
      `A category named '${existingName.name}' already exists.`,
      'Duplicate name',
    );
  }

  // Check for duplicate slug
  const existingSlug = await Category.findOne({ slug: payload.slug });
  if (existingSlug) {
    throw new AppError(
      httpStatus.CONFLICT,
      `A category with slug '${payload.slug}' already exists.`,
      'Duplicate slug',
    );
  }

  const category = await Category.create(payload);
  return category;
};

// Get all categories
const getAllCategories = async (query: Record<string, unknown>) => {
  const { isActive, sort = 'order' } = query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true' || isActive === true;
  }

  const categories = await Category.find(filter).sort(sort as string);
  return categories;
};

// Get single category by id or slug
const getSingleCategory = async (idOrSlug: string) => {
  // Try ObjectId first, fall back to slug
  const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
  const category = isObjectId
    ? await Category.findById(idOrSlug)
    : await Category.findOne({ slug: idOrSlug });

  if (!category) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Category not found',
      'No category found with the given id or slug',
    );
  }
  return category;
};

// Update category
const updateCategory = async (
  id: string,
  payload: Partial<TCategory>,
) => {
  // If name is being changed, check for duplicate (case-insensitive)
  if (payload.name) {
    const existingName = await Category.findOne({
      name: { $regex: `^${payload.name}$`, $options: 'i' },
      _id: { $ne: id },
    });
    if (existingName) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A category named '${existingName.name}' already exists.`,
        'Duplicate name',
      );
    }
  }

  // If slug is being changed, check for duplicate
  if (payload.slug) {
    const existingSlug = await Category.findOne({
      slug: payload.slug,
      _id: { $ne: id },
    });
    if (existingSlug) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A category with slug '${payload.slug}' already exists.`,
        'Duplicate slug',
      );
    }
  }

  const updated = await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Category not found',
      'No category found with the given id',
    );
  }
  return updated;
};

// Delete category
const deleteCategory = async (id: string) => {
  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Category not found',
      'No category found with the given id',
    );
  }
  return deleted;
};

// Toggle isActive
const toggleCategoryStatus = async (id: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Category not found',
      'No category found with the given id',
    );
  }
  category.isActive = !category.isActive;
  await category.save();
  return category;
};

export const categoryServices = {
  createCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
};