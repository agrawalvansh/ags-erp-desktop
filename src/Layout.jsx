import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import NavBar from './pages/NavBar';
import { Toaster } from 'react-hot-toast';

function Layout() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <NavBar />
            <Toaster
                position="top-center"
                toastOptions={{
                    style: { background: '#05014A', color: '#fff', borderRadius: '8px' },
                    success: {
                        iconTheme: { primary: '#4ade80', secondary: '#fff' },
                    },
                    error: {
                        iconTheme: { primary: '#ef4444', secondary: '#fff' },
                    },
                }}
            />
            <Outlet />
        </>
    );
}

export default Layout;