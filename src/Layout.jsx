import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import NavBar from './pages/NavBar';
import { Toaster, toast } from 'react-hot-toast';

function ScrollToTop() {
    const location = useLocation();
    useEffect(() => {
        // Skip scroll-to-top when a page needs to scroll to a specific row
        const s = location.state;
        if (s?.editedProductCode || s?.returnedFromAccount || s?.fromAccount || s?.returnedFromOrder) return;
        window.scrollTo(0, 0);
    }, [location.pathname]);
    return null;
}

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
        // Quick Sales auto-cleanup notification
        if (window.api?.onQuickSalesCleanup) {
            window.api.onQuickSalesCleanup((data) => {
                if (data.count > 0) {
                    toast.success(`${data.count} quick sale${data.count > 1 ? 's' : ''} older than 30 days deleted`);
                }
            });
        }
        // App upgrade success notification
        if (window.api?.onAppUpgraded) {
            window.api.onAppUpgraded((data) => {
                toast.success(
                    `🎉 Successfully upgraded to v${data.version}!\nThank you for using AGS ERP.`,
                    { duration: 6000 }
                );
            });
        }
    }, []);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <ScrollToTop />
            <NavBar />
            <div className="print:hidden">
                <Toaster
                    position="top-center"
                    toastOptions={{
                        style: { background: '#0F172A', color: '#fff', borderRadius: '8px' },
                        success: {
                            iconTheme: { primary: '#4ade80', secondary: '#fff' },
                        },
                        error: {
                            iconTheme: { primary: '#ef4444', secondary: '#fff' },
                        },
                    }}
                />
            </div>
            <Outlet />
        </>
    );
}

export default Layout;