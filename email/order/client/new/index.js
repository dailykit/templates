import pug from 'pug';
import moment from 'moment-timezone';

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

const order_new = async ({
  data,
  meta: { format_currency, client, timezone },
}) => {
  try {
    const { order } = await client.request(ORDER, {
      id: data.id.toString(),
    });

    const settings = {
      brand: {
        name: '',
      },
      address: {
        lat: '',
        lng: '',
        city: '',
        line1: '',
        line2: '',
        state: '',
        country: '',
        zipcode: '',
      },
      contact: {
        phoneNo: '',
        email: '',
      },
    };
    if (order.source === 'a-la-carte') {
      const { brand } = await client.request(BRAND_ON_DEMAND_SETTING, {
        id: order.cart.brandId,
      });
      if (brand) {
        if (brand.brand.length > 0) {
          settings.brand.name = brand.brand[0].name || '';
        }
        if (brand.logo.length > 0) {
          settings.brand.logo = brand.logo[0].url || '';
        }
        if (brand.contact.length > 0) {
          settings.contact.email = brand.contact[0].email || '';
          settings.contact.phoneNo = brand.contact[0].phoneNo || '';
        }
        if ('address' in brand) {
          settings.address.line1 = brand.address[0].line1 || '';
          settings.address.line2 = brand.address[0].line2 || '';
          settings.address.city = brand.address[0].city || '';
          settings.address.state = brand.address[0].state || '';
          settings.address.country = brand.address[0].country || '';
          settings.address.zipcode = brand.address[0].zipcode || '';
          settings.address.lat = brand.address[0].lat || '';
          settings.address.lng = brand.address[0].lng || '';
        }
      }
    } else if (order.cart.source === 'subscription') {
      const { brand } = await client.request(BRAND_SUBSCRIPTION_SETTING, {
        id: order.cart.brandId,
      });
      if (brand) {
        if (brand.brand.length > 0) {
          settings.brand.name = brand.brand[0].name || '';
          settings.brand.logo = brand.brand[0].logo || '';
        }
        if (brand.contact.length > 0) {
          settings.contact.email = brand.contact[0].email || '';
          settings.contact.phoneNo = brand.contact[0].phoneNo || '';
        }
        if ('address' in brand) {
          settings.address.line1 = brand.address[0].line1 || '';
          settings.address.line2 = brand.address[0].line2 || '';
          settings.address.city = brand.address[0].city || '';
          settings.address.state = brand.address[0].state || '';
          settings.address.country = brand.address[0].country || '';
          settings.address.zipcode = brand.address[0].zipcode || '';
          settings.address.lat = brand.address[0].lat || '';
          settings.address.lng = brand.address[0].lng || '';
        }
      }
    }

    const { customerPhone, customerFirstName, customerLastName } =
      order.cart.customerInfo;

    const compiler = await pug.compileFile(__dirname + '/index.pug');

    const items = order.cart.products.nodes.map((node) => ({
      title: node.name.split('->').pop().trim(),
      price: format_currency(Number(node.parent.unitPrice) || 0),
    }));

    const dropoff = {
      startsAt: '',
      endsAt: '',
    };

    if (
      'slot' in order.cart.fulfillmentInfo.slot &&
      Object.keys(order.cart.fulfillmentInfo.slot).length > 0
    ) {
    }
    if (
      'from' in order.cart.fulfillmentInfo.slot &&
      order.cart.fulfillmentInfo.slot.from
    ) {
      dropoff.startsAt = moment(order.cart.fulfillmentInfo.slot.from)
        .tz(timezone)
        .format('ddd, DD MMM, YYYY HH:MMA');
    }
    if (
      'to' in order.cart.fulfillmentInfo.slot &&
      order.cart.fulfillmentInfo.slot.to
    ) {
      dropoff.endsAt = moment(order.cart.fulfillmentInfo.slot.to)
        .tz(timezone)
        .format('ddd, DD MMM, YYYY HH:MMA');
    }

    const plan = {
      title: '',
      serving: '',
      count: '',
    };

    if ('occurenceId' in order.cart && order.cart.occurenceId) {
      if (
        'subscriptionId' in order.cart.occurence &&
        order.cart.occurence.subscriptionId
      ) {
        if (
          'itemCountId' in order.cart.occurence.subscription &&
          order.cart.occurence.subscription.itemCountId
        ) {
          plan.count = order.cart.occurence.subscription.itemCount.count;
          if (
            'servingId' in order.cart.occurence.subscription.itemCount &&
            order.cart.occurence.subscription.itemCount.servingId
          ) {
            plan.serving =
              order.cart.occurence.subscription.itemCount.serving.size;
            if (
              'titleId' in
                order.cart.occurence.subscription.itemCount.serving &&
              order.cart.occurence.subscription.itemCount.serving.titleId
            ) {
              plan.title =
                order.cart.occurence.subscription.itemCount.serving.title.title;
            }
          }
        }
      }
    }

    const response = await compiler({
      plan,
      items,
      dropoff,
      id: data.id,
      source: order.cart.source,
      status: order.cart.orderStatus.title,
      isTest: order.cart.isTest,
      transactionId: order.cart.transactionId,
      paymentStatus: order.cart.paymentStatus,
      restaurant: {
        ...settings,
        address: normalizeAddress(settings.address),
      },
      customer: {
        phone: customerPhone,
        firstName: customerFirstName,
        lastName: customerLastName,
        address: normalizeAddress(order.cart.address),
      },
      tip: format_currency(Number(order.tip) || 0),
      tax: format_currency(Number(order.tax) || 0),
      discount: format_currency(Number(order.discount) || 0),
      itemTotal: format_currency(Number(order.itemTotal) || 0),
      amountPaid: format_currency(Number(order.amountPaid) || 0),
      deliveryPrice: format_currency(Number(order.deliveryPrice) || 0),
      isPickup: ['PREORDER_PICKUP', 'ONDEMAND_PICKUP'].includes(
        order.fulfillmentType
      ),
    });
    return response;
  } catch (error) {
    console.log(error);
    throw Error(error.message);
  }
};

export default order_new;

const ORDER = `
   query order($id: oid!) {
      order(id: $id) {
         id
         tax
         tip
         itemTotal
         discount
         currency
         itemTotal
         created_at
         amountPaid
         deliveryPrice
         fulfillmentType
         cartId
         cart {
            id
            status
            source
            isTest
            brandId
            address
            customerInfo
            paymentStatus
            transactionId
            fulfillmentInfo
            orderStatus {
               title
            }
            occurenceId: subscriptionOccurenceId
            occurence: subscriptionOccurence {
               subscriptionId
               subscription {
                  itemCountId: subscriptionItemCountId
                  itemCount: subscriptionItemCount {
                     count
                     servingId: subscriptionServingId
                     serving: subscriptionServing {
                        size: servingSize
                        titleId: subscriptionTitleId
                        title: subscriptionTitle {
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

const BRAND_ON_DEMAND_SETTING = `
   query brand($id: Int!) {
      brand(id: $id) {
         brand: onDemandSettings(
            where: { onDemandSetting: { identifier: { _eq: "Brand Name" } } }
         ) {
            name: value(path: "name")
         }
         logo: onDemandSettings(where: {onDemandSetting: {identifier: {_eq: "Brand Logo"}}}) {
            url: value(path:"url")
         }
         address: onDemandSettings(
            where: { onDemandSetting: { identifier: { _eq: "Location" } } }
         ) {
            lat: value(path: "lat")
            lng: value(path: "lng")
            city: value(path: "city")
            line1: value(path: "line1")
            line2: value(path: "line2")
            state: value(path: "state")
            country: value(path: "country")
            zipcode: value(path: "zipcode")
         }
         contact: onDemandSettings(
            where: { onDemandSetting: { identifier: { _eq: "Contact" } } }
         ) {
            email: value(path: "email")
            phoneNo: value(path: "phoneNo")
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
            name: value(path: "name")
            logo: value(path: "logo.url")
         }
         address: subscriptionStoreSettings(
            where: {
               subscriptionStoreSetting: { identifier: { _eq: "Location" } }
            }
         ) {
            lat: value(path: "lat")
            lng: value(path: "lng")
            city: value(path: "city")
            line1: value(path: "line1")
            line2: value(path: "line2")
            state: value(path: "state")
            country: value(path: "country")
            zipcode: value(path: "zipcode")
         }
         contact: subscriptionStoreSettings(
            where: {
               subscriptionStoreSetting: { identifier: { _eq: "Contact" } }
            }
         ) {
            email: value(path: "email")
            phoneNo: value(path: "phoneNo")
         }
      }
   }
`;
