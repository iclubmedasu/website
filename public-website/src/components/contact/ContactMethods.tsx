import { Mail, MapPin, Phone } from "lucide-react";
import type { PublicContactMethod } from "@iclub/shared";

function contactHref(method: PublicContactMethod): string | null {
    if (method.type === "EMAIL") {
        return `mailto:${method.value}`;
    }
    if (method.type === "PHONE") {
        return `tel:${method.value.replace(/\s+/g, "")}`;
    }
    if (method.type === "OTHER" && /^https?:\/\//i.test(method.value)) {
        return method.value;
    }
    return null;
}

function ContactMethodIcon({ type }: { type: PublicContactMethod["type"] }) {
    if (type === "EMAIL") return <Mail className="h-5 w-5" />;
    if (type === "PHONE") return <Phone className="h-5 w-5" />;
    if (type === "ADDRESS") return <MapPin className="h-5 w-5" />;
    return <Mail className="h-5 w-5" />;
}

interface ContactMethodsProps {
    methods: PublicContactMethod[];
}

export function ContactMethods({ methods }: ContactMethodsProps) {
    if (methods.length === 0) return null;

    return (
        <div className="mt-6 space-y-4">
            {methods.map((method) => {
                const href = contactHref(method);
                const content = (
                    <span className="inline-flex items-center gap-2 text-base font-medium text-purple-800">
                        <ContactMethodIcon type={method.type} />
                        <span>
                            {method.label !== method.value ? (
                                <>
                                    <span className="font-semibold">{method.label}: </span>
                                    {method.value}
                                </>
                            ) : (
                                method.value
                            )}
                        </span>
                    </span>
                );

                if (href) {
                    return (
                        <a key={method.id} href={href} className="block hover:underline">
                            {content}
                        </a>
                    );
                }

                return (
                    <p key={method.id} className="text-base text-purple-800">
                        {content}
                    </p>
                );
            })}
        </div>
    );
}
