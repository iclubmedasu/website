declare namespace NodeJS {
    interface ProcessEnv {
        DATABASE_URL?: string;
        JWT_SECRET?: string;
        DEVELOPER_EMAIL?: string;
        DEVELOPER_PASSWORD?: string;
        AUTH_COOKIE_NAME?: string;
        FRONTEND_ORIGINS?: string;
        GITHUB_USER_DATA_TOKEN?: string;
        GITHUB_USER_DATA_OWNER?: string;
        GITHUB_USER_DATA_REPO?: string;
        GITHUB_STORAGE_OWNER?: string;
        GITHUB_STORAGE_REPO?: string;
        GITHUB_STORAGE_TOKEN?: string;
        PORT?: string;
        NODE_ENV?: "development" | "test" | "production";
        RESEND_API_KEY?: string;
        RESEND_FROM_EMAIL?: string;
        RESEND_REPLY_TO?: string;
        PUBLIC_WEBSITE_URL?: string;
    }
}
