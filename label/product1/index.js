import pug from 'pug';
import QR from 'qrcode';

const PRODUCT = `
   query cartItems($id: Int_comparison_exp!) {
      cartItems(where: { id: $id }) {
         id
         displayName
         levelType
         cartItemType
         productOptionType
         displayUnitQuantity
         cart {
            orderId
         }
         productOption {
            quantity
            label
         }
      }
   }
`;

const label = async ({ data, meta: { client } }) => {
  try {
    const { cartItems = [] } = await client.request(PRODUCT, {
      id: { _eq: data.id },
    });
    if (cartItems.length === 0) return;
    const [cartItem] = cartItems;

    const qrCode = await QR.toDataURL(
      JSON.stringify({
        product_id: data.id,
        order_id: cartItem.cart.orderId,
        type: cartItem.productOptionType,
      })
    );

    const compiler = await pug.compileFile(__dirname + '/index.pug');

    const response = await compiler({
      qrCode,
      name: cartItem.displayName.split('->').pop().trim(),
      product: { id: cartItem.id },
      order: { id: cartItem.cart.orderId },
      quantity: `${cartItem.displayUnitQuantity || 1} x ${
        cartItem.productOption.label
      }`,
    });
    return response;
  } catch (error) {
    console.log('🚀 ~ file: index.js ~ line 56 ~ error', error);
    throw Error(error.message);
  }
};

export default label;
