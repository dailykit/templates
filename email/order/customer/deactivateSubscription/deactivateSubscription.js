import pug from 'pug'

const deactivateSubscription = async ({data, meta:{client}) => {
   try {
      const {
         brandCustomer: {
            brand: { contact, brand },
            customer: {
               platform_customer: { firstName, lastName }
            }
         }
      } = await client.request(CUSTOMER_DETAILS, {
         id: data.brandCustomerId
      })
      console.log('👉', data)
      if (contact.length === 0)
         return res.status(200).json({
            success: false,
            message: `No contact details linked to brand customer id ${data.brand_customerId}`
         })

      const [{ contactDetails }] = contact

      if (brand.length === 0)
         return res.status(200).json({
            success: false,
            message: `No brand details linked to brand customer id ${data.brand_customerId}`
         })

      const [{ brandSiteDetails }] = brand

      const customerDetails = {
         name: firstName + ' ' + lastName
      }

      const brandDetails = {
         name: brandSiteDetails.name,
         logo: brandSiteDetails.logo.url,
         email: contactDetails.email,
         phone: contactDetails.phoneNo
      }
      // console.log("👩", data.readVar)
      if (data.readVar) {
         console.log(data.readVar)
         return {
            customerDetails,
            brandDetails
         }
      } else if (data.readAlias) {
         return `{
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
         }`
      } else {
         const compiler = await pug.compileFile(
            __dirname + `/${data.emailTemplateFileName}`
         )

         const response = await compiler({
            customerDetails,
            brandDetails
         })
         return response
      }
   } catch (error) {
      throw error
   }
}

export default deactivateSubscription

const CUSTOMER_DETAILS = `
   query CustomerDetails($id: Int!) {
      brandCustomer(id: $id) {
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
               defaultCustomerAddress {
                  city
                  country
                  additionalInfo
                  landmark
                  line1
                  line2
                  state
                  zipcode
                  lng
                  notes
                  lat
                  label
                  id
               }
            }
         }
      }
   }
`
