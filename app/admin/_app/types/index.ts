export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    token?: string;
}

export interface SidebarItem {
    name: string;
    href: string;
    icon: React.ReactNode;
}
