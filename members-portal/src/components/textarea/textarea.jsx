import { TextArea } from "@/components/base/textarea/textarea";

export const DisabledDemo = () => {
    return <TextArea isRequired isDisabled placeholder="This is a placeholder." label="Description" hint="This is a hint text to help user." rows={5} />;
};

export const InvalidDemo = () => {
    return <TextArea isRequired isInvalid placeholder="This is a placeholder." label="Description" hint="This is an error message." rows={5} />;
};