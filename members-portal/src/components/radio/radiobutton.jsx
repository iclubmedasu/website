import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";

export const WithLabelAndHintDemo = () => {
  return (
    <RadioGroup aria-label="Pricing plans" defaultValue="basic">
      <RadioButton label="Basic plan" hint="Up to 10 users and 20 GB data." value="basic" />
      <RadioButton label="Business plan" hint="Up to 20 users and 40 GB data." value="business" />
      <RadioButton label="Enterprise plan" hint="Unlimited users and unlimited data." value="enterprise" />
    </RadioGroup>
  );
};