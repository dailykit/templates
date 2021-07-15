import pug from 'pug';

const kot = async ({ data, meta: { client } }) => {
  try {
    const { order: { id = '' } = {}, station = { ids: [] } } = data;

    const { order = {} } = await client.request(ORDER, {
      id,
      ...(station.ids.length && { stationId: { _in: station.ids } }),
    });

    let stationName = null;

    const items = order.cart.cartItems_aggregate.nodes.map((node) => {
      const object = {
        name: node.displayName.split('->').pop().trim(),
        sachets: {},
      };
      object.sachets = {
        count: node.childs_aggregate.aggregate.count,
        list: node.childs_aggregate.nodes.map((item) => {
          const data = {
            name: item.displayName.split('->').pop().trim(),
            processing: item.processingName,
            unitQuantity: item.displayUnitQuantity,
            supplier: {
              name: 'N/A',
              item: {
                name: 'N/A',
              },
            },
            packaging: { name: 'N/A' },
            station: 'N/A',
            quantity: `${item.displayUnitQuantity}${item.displayUnit}`,
          };

          if (item.supplierItemId) {
            data.supplier.item.name = `${item.supplierItem.name} - ${item.supplierItem.name.unitSize} ${item.supplierItem.name.unit}`;
            if (item.supplierItem.supplierId) {
              data.supplier.name = item.supplierItem.supplier.name;
            }
          }

          if (item.operationConfigId) {
            if (item.operationConfig.stationId) {
              if (station.ids.length === 1) {
                stationName = item.operationConfig.station.name;
              }
              data.station = item.operationConfig.station.name;
            }
            if (item.operationConfig.packagingId) {
              data.packaging.name = item.operationConfig.packaging.name;
            }
          }

          return data;
        }),
      };
      return object;
    });

    const compiler = await pug.compileFile(__dirname + '/index.pug');

    const readyBy =
      order.readyByTimestamp &&
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(new Date(order.readyByTimestamp));

    const fulfillmentType = capitalize(
      capitalize(order.fulfillmentType.split('_').join(' '), true)
    );

    const response = await compiler({
      id,
      readyBy,
      items,
      stationName,
      fulfillmentType,
      customer: order.cart.customerInfo,
    });

    return response;
  } catch (error) {
    console.log('error', error);
    throw Error(error.message);
  }
};

export default kot;

const capitalize = (str, lower = false) =>
  (lower ? str.toLowerCase() : str).replace(/(?:^|\s|["'([{])+\S/g, (match) =>
    match.toUpperCase()
  );

const ORDER = `
   query order($id: oid!, $stationId: Int_comparison_exp) {
      order(id: $id) {
         fulfillmentType
         cart {
            customerInfo
            cartItems_aggregate(
               where: {
                  levelType: { _eq: "orderItem" }
                  operationConfig: { stationId: $stationId }
               }
            ) {
               aggregate {
                  count
               }
               nodes {
                  id
                  displayName
                  childs_aggregate {
                     aggregate {
                        count
                     }
                     nodes {
                        id
                        displayName
                        displayUnit
                        processingName
                        displayUnitQuantity
                        operationConfigId
                        operationConfig {
                           stationId
                           station {
                              id
                              name
                           }
                           packagingId
                           packaging {
                              id
                              name
                           }
                        }
                        supplierItemId
                        supplierItem {
                           unit
                           unitSize
                           supplierId
                           supplier {
                              id
                              name
                           }
                           name: supplierItemName
                        }
                     }
                  }
               }
            }
         }
      }
   }
`;
