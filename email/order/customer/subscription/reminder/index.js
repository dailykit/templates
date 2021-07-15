require('dotenv').config();
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

const reminder_email = async ({
  data,
  template,
  meta: { client, format_currency },
}) => {
  try {
    const { subscriptionOccurenceId, brand_customerId } = data;
    const {
      readVar = null,
      readAlias = null,
      emailTemplateFileName,
    } = template;
    const { subscriptionOccurences } = await client.request(
      SUBSCRIPTION_DETAILS,
      {
        id: subscriptionOccurenceId,
      }
    );

    if (subscriptionOccurences.length === 0)
      throw Error(
        `No subscription occurence linked to id ${subscriptionOccurenceId}`
      );

    const [occurence] = subscriptionOccurences;
    const {
      fulfillmentDate,
      cutoffTimeStamp,
      subscriptionTitle: { title = '' } = {},
      subscriptionItemCount: { count = '' } = {},
      subscriptionServing: { servingSize = '' } = {},
    } = occurence;

    const subscriptionDetails = {
      title,
      count,
      servingSize,
      deliveryDate: moment(fulfillmentDate).format('ddd MMM DD, YYYY'),
      cutOffTimeStamp: moment(cutoffTimeStamp).format(
        'ddd MMM DD, YYYY hh:mma'
      ),
      siteUrl:
        new URL(process.env.DATAHUB).origin +
        '/subscription/menu?d=' +
        fulfillmentDate,
    };

    const { brandCustomer = {} } = await client.request(CUSTOMER_DETAILS, {
      id: parseInt(brand_customerId),
    });

    const {
      keycloakId,
      subscriptionAddressId,
      brand: { contact, brand },
      customer: { platform_customer = {} } = {},
    } = brandCustomer;

    const customerDetails = {
      name: '',
      address: '',
    };

    if ('firstName' in platform_customer && platform_customer.firstName) {
      customerDetails.name = platform_customer.firstName;
    }
    if ('lastName' in platform_customer && platform_customer.lastName) {
      customerDetails.name += ' ' + platform_customer.lastName;
    }
    if (
      'addresses' in platform_customer &&
      Array.isArray(platform_customer.addresses) &&
      platform_customer.addresses.length > 0
    ) {
      const index = platform_customer.addresses.findIndex(
        (node) => node.id === subscriptionAddressId
      );
      if (index !== 1) {
        customerDetails.address = normalizeAddress(
          platform_customer.addresses[index]
        );
      }
    }

    if (contact.length === 0)
      return res.status(200).json({
        success: false,
        message: `No contact details linked to brand customer id ${brand_customerId}`,
      });

    const [{ contactDetails }] = contact;

    if (brand.length === 0)
      return res.status(200).json({
        success: false,
        message: `No brand details linked to brand customer id ${brand_customerId}`,
      });

    const [{ brandSiteDetails }] = brand;

    const brandDetails = {
      name: brandSiteDetails.name,
      logo: brandSiteDetails.logo.url,
      email: contactDetails.email,
      phone: contactDetails.phoneNo,
    };

    if (readVar === true) {
      return JSON.stringify({
        subscriptionDetails,
        customerDetails,
        brandDetails,
      });
    }

    if (readAlias === true) {
      return `{
            subscriptionDetails {
               deliveryDate,
               cutOffTimeStamp,
               count,
               servingSize,
               title,
               siteUrl
            }
            customerDetails{
               name,
               address
            }
            brandDetails {
               name,
               logo,
               email,
               phone
            }
         }`;
    }

    const { carts = [] } = await client.request(CART_PRODUCTS, {
      where_cart: {
        customerKeycloakId: { _eq: keycloakId },
        subscriptionOccurenceId: { _eq: subscriptionOccurenceId },
      },
      where_cartItem: {
        levelType: { _eq: 'orderItem' },
      },
    });

    let cart = {
      id: null,
      products: [],
      tip: 0,
      tax: 0,
      discount: 0,
      itemTotal: 0,
      amountPaid: 0,
      deliveryPrice: 0,
    };

    if (carts.length > 0) {
      const [one] = carts;
      cart.id = one.id;
      cart.tip = format_currency(Number(one.tip) || 0);
      cart.tax = format_currency(Number(one.tax) || 0);
      cart.discount = format_currency(Number(one.discount) || 0);
      cart.itemTotal = format_currency(Number(one.itemTotal) || 0);
      cart.totalPrice = format_currency(Number(one.totalPrice) || 0);
      cart.deliveryPrice = format_currency(Number(one.deliveryPrice) || 0);

      if (one.cartItems_aggregate.aggregate.count > 0) {
        const { nodes = [] } = one.cartItems_aggregate;
        cart.products = nodes.map((node) => ({
          id: node.id,
          image: node.image,
          price: format_currency(Number(node.unitPrice)),
          name: node.productOptionId ? node.productOptionView.displayName : '',
        }));
      }
    }

    const compiler = await pug.compileFile(
      __dirname + '/' + emailTemplateFileName
    );

    const response = await compiler({
      cart,
      subscriptionDetails,
      customerDetails,
      brandDetails,
    });
    return response;
  } catch (error) {
    console.log('reminder -> error -> ', error);
    throw error;
  }
};

export default reminder_email;

const CUSTOMER_DETAILS = `
   query brandCustomer($id: Int!) {
      brandCustomer(id: $id) {
         keycloakId
         subscriptionAddressId
         brand {
            contact: subscriptionStoreSettings(
               where: {
                  subscriptionStoreSetting: {
                     identifier: { _eq: "Contact" }
                     type: { _eq: "brand" }
                  }
               }
            ) {
               contactDetails: value
            }
            brand: subscriptionStoreSettings(
               where: {
                  subscriptionStoreSetting: {
                     identifier: { _eq: "theme-brand" }
                     type: { _eq: "brand" }
                  }
               }
            ) {
               brandSiteDetails: value
            }
         }
         customer {
            platform_customer {
               firstName
               lastName
               addresses: customerAddresses {
                  id
                  lat
                  lng
                  city
                  line1
                  line2
                  state
                  notes
                  label
                  country
                  zipcode
                  landmark
                  additionalInfo
               }
            }
         }
      }
   }
`;

const SUBSCRIPTION_DETAILS = `
   query SubscriptionDetails($id: Int!) {
      subscriptionOccurences(where: { id: { _eq: $id } }) {
         fulfillmentDate
         cutoffTimeStamp
         subscriptionTitle {
            title
         }
         subscriptionServing {
            servingSize
         }
         subscriptionItemCount {
            count
         }
      }
   }
`;

const CART_PRODUCTS = `
   query carts(
      $where_cart: order_cart_bool_exp = {}
      $where_cartItem: order_cartItem_bool_exp = {}
   ) {
      carts(where: $where_cart) {
         id
         tip
         tax
         discount
         itemTotal
         totalPrice
         deliveryPrice
         cartItems_aggregate(where: $where_cartItem) {
            aggregate {
               count
            }
            nodes {
               id
               unitPrice
               productOptionId
               image: displayImage
               productOptionView {
                  displayName
               }
            }
         }
      }
   }
`;
