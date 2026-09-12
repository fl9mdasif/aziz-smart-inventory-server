export const createAdminOrderNotificationEmail = (order: any) => {
    const itemsHtml = order.items.map((item: any) => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px 0; display: flex; align-items: center; gap: 10px;">
                ${item.product?.thumbnail ? `<img src="${item.product.thumbnail}" alt="${item.product.name}" style="width: 40px; hieght: 40px; object-fit: cover; border-radius: 4px;" />` : ''}
                <div>
                    <div style="font-weight: bold;">${item.product?.name || 'Product'}</div>
                    <div style="font-size: 12px; color: #666;">${item.variant.name}</div>
                </div>
            </td>
            <td style="padding: 10px 0; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px 0; text-align: right;">৳${item.totalPrice}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background-color: #B5451B; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
                .order-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .btn { display: inline-block; padding: 10px 20px; background-color: #B5451B; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Order Received!</h1>
                </div>
                <div class="content">
                    <p>Hello Admin,</p>
                    <p>A new order has been placed on <strong>HydraaZone</strong>.</p>
                    <p><strong>Order Number:</strong> #${order.orderNumber}</p>
                    <p><strong>Total Amount:</strong> ৳${order.totalAmount}</p>
                    
                    <h3>Customer Details:</h3>
                    <p>
                        <strong>Name:</strong> ${order.shippingAddress.fullName}<br>
                        <strong>Phone:</strong> ${order.shippingAddress.phone}<br>
                        <strong>Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city}
                    </p>

                    <table class="order-table">
                        <thead>
                            <tr style="border-bottom: 2px solid #B5451B;">
                                <th style="text-align: left; padding-bottom: 10px;">Item</th>
                                <th style="text-align: center; padding-bottom: 10px;">Qty</th>
                                <th style="text-align: right; padding-bottom: 10px;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2" style="padding-top: 15px; font-weight: bold;">Grand Total:</td>
                                <td style="padding-top: 15px; text-align: right; font-weight: bold; color: #B5451B;">৳${order.totalAmount}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <p style="text-align: center;">
                        <a href="https://www.hydraazone.com/dashboard/admin/orders" class="btn">Manage Orders</a>
                    </p>
                </div>
                <div class="footer">
                    &copy; 2026 HydraaZone. All rights reserved.
                </div>
            </div>
        </body>
        </html>
    `;
};

export const createUserOrderShippedEmail = (order: any) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; }
                .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 20px; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
                .btn { display: inline-block; padding: 10px 20px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Your Order is Shipped!</h1>
                </div>
                <div class="content">
                    <p>Hello ${order.shippingAddress.fullName},</p>
                    <p>Good news! Your order <strong>#${order.orderNumber}</strong> from <strong>HydraaZone</strong> has been shipped and is on its way to you.</p>
                    
                    <p>It will be delivered to:</p>
                    <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #16a34a;">
                        ${order.shippingAddress.address}, ${order.shippingAddress.city}<br>
                        Phone: ${order.shippingAddress.phone}
                    </p>

                    <h3>Order Summary:</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        ${order.items.map((item: any) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 10px 0; display: flex; align-items: center; gap: 10px;">
                                    ${item.product?.thumbnail ? `<img src="${item.product.thumbnail}" alt="${item.product.name}" style="width: 40px; hieght: 40px; object-fit: cover; border-radius: 4px;" />` : ''}
                                    <div>
                                        <div style="font-weight: bold;">${item.product?.name || 'Product'}</div>
                                        <div style="font-size: 12px; color: #666;">${item.variant.name}</div>
                                    </div>
                                </td>
                                <td style="padding: 10px 0; text-align: right;">${item.quantity} x ৳${item.variant.discountPrice ?? item.variant.price}</td>
                            </tr>
                        `).join('')}
                    </table>

                    <p>Total Paid: <strong>৳${order.totalAmount}</strong></p>

                    <p>We hope you enjoy your products! Thank you for shopping with us.</p>

                    <p style="text-align: center;">
                        <a href="https://www.hydraazone.com/dashboard/user/orders" class="btn">Track Order</a>
                    </p>
                </div>
                <div class="footer">
                    &copy; 2026 HydraaZone. All rights reserved.
                </div>
            </div>
        </body>
        </html>
    `;
};
