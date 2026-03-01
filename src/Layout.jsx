import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import NavBar from './pages/NavBar';
import { Toaster, toast } from 'react-hot-toast';

function Layout() {
    const { isAuthenticated } = useAuth();

    // Global listener for Marathi batch transliteration events
    useEffect(() => {
        if (window.api?.onMarathiBatchStart) {
            window.api.onMarathiBatchStart((data) => {
                toast.loading(`Generating Marathi script for ${data.total} products...`, { id: 'marathi-batch' });
            });
        }
        if (window.api?.onMarathiBatchComplete) {
            window.api.onMarathiBatchComplete((data) => {
                toast.dismiss('marathi-batch');
                if (data.translated > 0) {
                    toast.success(`Marathi script generation completed (${data.translated} products)`);
                }
            });
        }
    }, []);

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