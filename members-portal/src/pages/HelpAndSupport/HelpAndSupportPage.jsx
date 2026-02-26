import { ExternalLink } from 'lucide-react';
import '../Teams/TeamsPage.css';
import './HelpAndSupportPage.css';

const INCIDENT_REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSevHhFwqy5STXtS077IrSkWVXXBfDvVFsf-z4V5fDT330X49w/viewform';

function HelpAndSupportPage() {
    return (
        <div className="help-support-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Help and Support</h1>
            </div>

            <hr className="title-divider" />

            <div className="card help-support-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Incident Report</h3>
                        <p className="card-subtitle">Submit a report or request via the official form</p>
                    </div>
                    <a
                        href={INCIDENT_REPORT_FORM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="incident-report-link"
                    >
                        <span>Open incident report form</span>
                        <ExternalLink size={18} aria-hidden />
                    </a>
                </div>
                <div className="card-body">
                    {/* English version */}
                    <div className="help-support-description help-support-en" lang="en">
                        <p className="help-support-intro">
                            Dear all, we hope this message finds you well.
                        </p>
                        <p>
                            Please ensure that every committee informs its members about the <strong>Incident Report</strong> channel. This allows any student who may feel hesitant or uncomfortable to still report an issue or concern in a confidential way.
                        </p>
                        <ul className="help-support-list">
                            <li><strong>General Report:</strong> No personal details are required from the student.</li>
                            <li><strong>Personal Report:</strong> The student’s name and contact number are needed so we can follow up in case of any misunderstanding or to clarify details.</li>
                            <li><strong>Request Report:</strong> For any suggestion or request that a student would like to see implemented in iClub.</li>
                        </ul>
                    </div>

                    <hr className="help-support-divider" />

                    {/* Arabic version */}
                    <div className="help-support-description" dir="rtl" lang="ar">
                        <p className="help-support-intro">
                            السلام عليكم ورحمة الله وبركاته،<br />
                            نأمل أن تكونوا جميعاً بخير.
                        </p>
                        <p>
                            يُرجى من كل لجنة إعلام أعضائها بقناة <strong>تقرير الحوادث (Incident Report)</strong>؛ حتى يتمكّن أي طالب يشعر بالتردد أو بعدم الارتياح من التبليغ عن أي مشكلة أو استفسار بشكل سري.
                        </p>
                        <ul className="help-support-list">
                            <li><strong>التقرير العام (General Report):</strong> لا يتطلب أي بيانات شخصية عن الطالب.</li>
                            <li><strong>التقرير الشخصي (Personal Report):</strong> يُطلب اسم الطالب ورقم التواصل لمتابعة الحالة أو توضيح أي سوء فهم عند الحاجة.</li>
                            <li><strong>تقرير الطلبات (Request Report):</strong> مخصّص لأي اقتراح أو طلب يرغب الطالب في تنفيذه ضمن iClub.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HelpAndSupportPage;
