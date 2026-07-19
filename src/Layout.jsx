import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import NavBar from './pages/NavBar';
import { Toaster, toast } from 'react-hot-toast';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import ShortcutsModal from './components/ShortcutsModal';

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
    const { showShortcutsModal, setShowShortcutsModal } = useGlobalShortcuts();

    // Global listener for Marathi batch transliteration events
    useEffect(() => {
        let cleanupStart, cleanupComplete, cleanupQs, cleanupApp;

        if (window.api?.onMarathiBatchStart) {
            cleanupStart = window.api.onMarathiBatchStart((data) => {
                toast.loading(`Generating Marathi script for ${data.total} products...`, { id: 'marathi-batch' });
            });
        }
        if (window.api?.onMarathiBatchComplete) {
            cleanupComplete = window.api.onMarathiBatchComplete((data) => {
                toast.dismiss('marathi-batch');
                if (data.translated > 0) {
                    toast.success(`Marathi script generation completed (${data.translated} products)`);
                }
            });
        }
        // Quick Sales auto-cleanup notification
        if (window.api?.onQuickSalesCleanup) {
            cleanupQs = window.api.onQuickSalesCleanup((data) => {
                if (data.count > 0) {
                    toast.success(`${data.count} quick sale${data.count > 1 ? 's' : ''} older than 30 days deleted`);
                }
            });
        }
        if (window.api?.onAppUpgraded) {
            cleanupApp = window.api.onAppUpgraded((data) => {
                toast(
                    `Successfully upgraded to v${data.to}!\nThank you for using AGS ERP.`,
                    {
                        duration: 6000,
                        icon: '🎉',
                        style: {
                            background: '#004AC6',
                            color: '#FFFFFF',
                            borderRadius: '12px',
                            fontWeight: '600',
                            padding: '14px 20px',
                            boxShadow: '0 8px 30px rgba(0, 74, 198, 0.3)',
                        },
                    }
                );
            });
        }

        return () => {
            if (cleanupStart) cleanupStart();
            if (cleanupComplete) cleanupComplete();
            if (cleanupQs) cleanupQs();
            if (cleanupApp) cleanupApp();
        };
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
            <ShortcutsModal
                isOpen={showShortcutsModal}
                onClose={() => setShowShortcutsModal(false)}
            />
        </>
    );
}

export default Layout;