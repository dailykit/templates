import pug from 'pug';
import QR from 'qrcode';

const label = async ({ data, meta: { client } }) => {
  try {
    const { cartItems = [] } = await client.request(SACHET, {
      id: { _eq: data.id },
    });

    if (cartItems.length === 0) return;
    const [cartItem] = cartItems;

    const qrCode = await QR.toDataURL(
      JSON.stringify({
        type: cartItem.productOptionType,
        sachet_id: data.id,
        product_id: cartItem.parentCartItemId,
        order_id: cartItem.cart.orderId,
      })
    );

    const compiler = await pug.compileFile(__dirname + '/index.pug');

    const response = await compiler({
      ...cartItem,
      name: cartItem.displayName.split('->').pop().trim(),
      qrCode,
    });
    return response;
  } catch (error) {
    throw Error(error.message);
  }
};

export default label;

const SACHET = `
   query cartItems($id: Int_comparison_exp!) {
      cartItems(where: { id: $id }) {
         id
         levelType
         displayName
         cartItemType
         displayUnit
         processingName
         productOptionType
         parentCartItemId
         displayUnitQuantity
         cart {
            orderId
         }
         product {
            id
            name
         }
         productOption {
            quantity
            label
         }
      }
   }
`;
