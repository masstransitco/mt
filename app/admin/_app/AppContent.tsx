import React, { ReactNode } from 'react';
import { CContainer } from '@coreui/react';

interface AppContentProps {
    element?: ReactNode;
}

const AppContent: React.FC<AppContentProps> = ({ element }) => {
    return (
        <CContainer fluid className="min-vh-100 bg-white fs-14px">
            <div className="p-2">{element}</div>
        </CContainer>
    );
};


export default React.memo(AppContent);