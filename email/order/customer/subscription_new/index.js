import pug from 'pug';

const normalizeAddress = (address) => {
  if (!address) return '';
  let result = '';
  if (address.line1) result += `${address.line1}, `;
  if (address.line2) result += `${address.line2}, `;
  if (address.city) result += `${address.city}, `;
  if (address.state) result += `${address.state}, `;
  if (address.country) result += `${address.country}, `;
  if (address.zipcode) result += `${address.zipcode}`;
  return result;
};

const email = async ({ data, meta: { client, format_currency } }) => {
  try {
    const { order } = await client.request(ORDER, {
      id: data.id.toString(),
    });

    if (!order) throw 'No such order exists';

    const restaurant = {
      brand: {
        logo: {
          logoMark: '',
        },
        name: '',
        website: '',
      },
      address: '',
      contact: {
        phoneNo: '',
        email: '',
      },
    };
    if (order.cart.source === 'subscription') {
      const { brand = {} } = await client.request(BRAND_SUBSCRIPTION_SETTING, {
        id: order.cart.brandId,
      });
      if ('brand' in brand) {
        restaurant.brand = brand.brand.length > 0 ? brand.brand[0].value : {};
      }
      if ('contact' in brand) {
        restaurant.contact =
          brand.contact.length > 0 ? brand.contact[0].value : {};
      }
      if ('address' in brand) {
        restaurant.address =
          brand.address.length > 0
            ? normalizeAddress(brand.address[0].value)
            : '';
      }
    }

    const plan = {
      title: '',
      itemCount: 0,
      serving: 0,
      deliveryDate: '',
    };

    if ('occurence' in order.cart && order.cart.occurence) {
      if (
        'fulfillmentDate' in order.cart.occurence &&
        order.cart.occurence.fulfillmentDate
      ) {
        plan.deliveryDate = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(order.cart.occurence.fulfillmentDate));
      }
      if ('subscription' in order.cart.occurence) {
        if ('itemCount' in order.cart.occurence.subscription) {
          if ('count' in order.cart.occurence.subscription.itemCount) {
            plan.itemCount = order.cart.occurence.subscription.itemCount.count;
          }
          if ('serving' in order.cart.occurence.subscription.itemCount) {
            if ('size' in order.cart.occurence.subscription.itemCount.serving) {
              plan.serving =
                order.cart.occurence.subscription.itemCount.serving.size;
            }
            if ('plan' in order.cart.occurence.subscription.itemCount.serving) {
              if (
                'title' in
                order.cart.occurence.subscription.itemCount.serving.plan
              ) {
                plan.title =
                  order.cart.occurence.subscription.itemCount.serving.plan.title;
              }
            }
          }
        }
      }
    }

    const customer = {
      name: '',
      address: '',
      phone: '',
      email: '',
    };

    if ('customerFirstName' in order.cart.customerInfo) {
      customer.name = order.cart.customerInfo.customerFirstName || '';
    }
    if ('customerLastName' in order.cart.customerInfo) {
      customer.name += ` ${order.cart.customerInfo.customerLastName || ''}`;
    }
    if ('customerEmail' in order.cart.customerInfo) {
      customer.email = order.cart.customerInfo.customerEmail;
    }
    if ('address' in order.cart) {
      customer.address = normalizeAddress(order.cart.address);
    }
    if ('customerPhone' in order.cart.customerInfo) {
      customer.phone = order.cart.customerInfo.customerPhone || '';
    }

    const billing = {
      tax: format_currency(Number(order.tax) || 0),
      base: format_currency(Number(order.itemTotal) || 0),
      total: format_currency(Number(order.amountPaid) || 0),
      discount: format_currency(Number(order.discount) || 0),
      delivery: format_currency(Number(order.deliveryPrice) || 0),
      addOnTotal: format_currency(Number(order.cart.addOnTotal) || 0),
    };

    let products = [];
    if (order.cart.products.aggregate.count > 0) {
      products = order.cart.products.nodes.map((node) => ({
        id: node.id,
        name: node.name.split('->').pop().trim(),
        image: node.displayImage,
        ...(Boolean(node.addOnPrice) && {
          addOnPrice: format_currency(Number(node.addOnPrice) || 0),
        }),
      }));
    }

    const compiler = await pug.compileFile(__dirname + '/index.pug');

    const response = await compiler({
      plan,
      billing,
      customer,
      products,
      restaurant,
      id: order.id,
      isTest: order.cart.isTest,
      transactionId: order.cart.transactionId,
      paymentStatus: order.cart.paymentStatus,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

export default email;

const ORDER = `
   query order($id: oid!) {
      order(id: $id) {
         id
         tax
         discount
         itemTotal
         created_at
         amountPaid
         deliveryPrice
         fulfillmentType
         cart {
            id
            orderStatus {
               title
            }
            address
            source
            paymentStatus
            transactionId
            isTest
            brandId
            addOnTotal
            customerInfo
            occurence: subscriptionOccurence {
               fulfillmentDate
               subscription {
                  itemCount: subscriptionItemCount {
                     count
                     serving: subscriptionServing {
                        size: servingSize
                        plan: subscriptionTitle {
                           title
                        }
                     }
                  }
               }
            }
            products: cartItems_aggregate(
               where: { levelType: { _eq: "orderItem" } }
            ) {
               aggregate {
                  count
               }
               nodes {
                  id
                  displayImage
                  addOnLabel
                  addOnPrice
                  parent {
                     unitPrice
                  }
                  name: displayName
               }
            }
         }
      }
   }
`;

export const BRAND_SUBSCRIPTION_SETTING = `
   query brand($id: Int!) {
      brand(id: $id) {
         brand: subscriptionStoreSettings(
            where: {
               subscriptionStoreSetting: { identifier: { _eq: "theme-brand" } }
            }
         ) {
            value
         }
         address: subscriptionStoreSettings(
            where: {
               subscriptionStoreSetting: { identifier: { _eq: "Location" } }
            }
         ) {
            value
         }
         contact: subscriptionStoreSettings(
            where: {
               subscriptionStoreSetting: { identifier: { _eq: "Contact" } }
            }
         ) {
            value
         }
      }
   }
`;
