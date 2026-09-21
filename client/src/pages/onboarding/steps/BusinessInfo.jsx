import { Field } from '../../../components/Field.jsx'
import { StepCard } from '../ui.jsx'

export default function BusinessInfo({ data, update, errors, clearError }) {
  const b = data.businessInfo
  const set = (key) => (e) => {
    update('businessInfo', (d) => {
      d[key] = e.target.value
    })
    clearError(key)
  }

  return (
    <StepCard
      number={1}
      name="Business info"
      title="Let's start with the basics"
      intro="The details customers and couriers use to reach you. All of it is editable later."
    >
      <div className="stack-lg">
        <Field label="Business name" hint="Exactly as it's registered on your CAC certificate." error={errors.name}>
          {(aria) => <input className="input" autoComplete="organization" placeholder="Adé Fine Jewellery" value={b.name} onChange={set('name')} {...aria} />}
        </Field>

        <Field
          label="Description of the business"
          hint="This is what shows up when someone searches your brand online — keep it to 1–2 sentences."
          error={errors.description}
        >
          {(aria) => (
            <textarea
              className="textarea"
              style={{ minHeight: 84 }}
              placeholder="Handmade gold jewellery for everyday wear, made to order in Lagos."
              value={b.description}
              onChange={set('description')}
              {...aria}
            />
          )}
        </Field>

        <div className="grid-2">
          <Field label="Business email" hint="A Gmail or similar inbox you check daily." error={errors.email}>
            {(aria) => (
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="hello@yourstore.com"
                value={b.email}
                onChange={set('email')}
                {...aria}
              />
            )}
          </Field>
          <Field label="Business phone number" hint="The number customers can call or message on WhatsApp." error={errors.phone}>
            {(aria) => (
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                placeholder="+234 800 000 0000"
                value={b.phone}
                onChange={set('phone')}
                {...aria}
              />
            )}
          </Field>
        </div>

        <Field label="Business address" hint="Where you're based — street, city, and state is enough." error={errors.address}>
          {(aria) => (
            <textarea
              className="textarea"
              style={{ minHeight: 70 }}
              autoComplete="street-address"
              placeholder="12 Awolowo Road, Ikoyi, Lagos"
              value={b.address}
              onChange={set('address')}
              {...aria}
            />
          )}
        </Field>
      </div>
    </StepCard>
  )
}
