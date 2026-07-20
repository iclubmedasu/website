import { redirect } from 'next/navigation';

export default function NewCertificateTemplatePage() {
    redirect('/certificates?template=new');
}
