import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { ToastProvider } from './components/ui/Toast';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { NoAccess } from './components/ui/NoAccess';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PermissionKey } from './types';

// Layouts
import { ResellerLayout } from './components/layout/ResellerLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Eager entry routes (instant first paint)
import Index from './pages/Index';
import Login from './pages/Login';

// Lazy-loaded Reseller routes
const Catalog = lazy(() => import('./pages/Catalog'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Orders = lazy(() => import('./pages/Orders'));
const Account = lazy(() => import('./pages/Account'));

// Lazy-loaded Admin routes
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProductsList = lazy(() => import('./pages/admin/ProductsList'));
const AdminProductForm = lazy(() => import('./pages/admin/ProductForm'));
const AdminCategoriesList = lazy(() => import('./pages/admin/CategoriesList'));
const AdminResellersList = lazy(() => import('./pages/admin/ResellersList'));
const AdminResellerNew = lazy(() => import('./pages/admin/ResellerNew'));
const AdminResellerDetail = lazy(() => import('./pages/admin/ResellerDetail'));
const AdminOrdersList = lazy(() => import('./pages/admin/OrdersList'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminTeamList = lazy(() => import('./pages/admin/TeamList'));
const AdminActivityLog = lazy(() => import('./pages/admin/ActivityLog'));

const NotFound = lazy(() => import('./pages/NotFound'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-[3px] border-slate-200 border-t-[#187004] animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 15,
    },
  },
});

/**
 * Guard for Reseller routes
 */
function ResellerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF8]">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#187004] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <ResellerLayout>{children}</ResellerLayout>;
}

/**
 * Guard for Admin & Staff Admin routes
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role, isLoading } = useAuthStore();
  const { isLoadingPermissions } = usePermissions();
  const location = useLocation();

  if (isLoading || (isAuthenticated && (role === 'admin' || role === 'staff') && isLoadingPermissions)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#071d02]">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-950 border-t-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (role !== 'admin' && role !== 'staff') {
    return <Navigate to="/catalog" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

/**
 * Route guard enforcing specific permission key
 */
function RequirePermission({
  perm,
  children,
}: {
  perm: PermissionKey;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(perm)) {
    return <NoAccess requiredPermission={perm} />;
  }
  return <>{children}</>;
}

/**
 * Route guard restricted strictly to Super Admin (role === 'admin')
 */
function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = usePermissions();
  if (!isSuperAdmin) {
    return <NoAccess superAdminOnly />;
  }
  return <>{children}</>;
}

export default function App() {
  const { checkAuth, profile } = useAuthStore();
  const { setUserId } = useCartStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Sync current user id with cart storage key
  useEffect(() => {
    setUserId(profile ? profile.id : null);
  }, [profile, setUserId]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PermissionsProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
              {/* Root Index Route */}
              <Route path="/" element={<Index />} />

              {/* Public Partner Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Dedicated Executive Admin Login Route */}
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* Reseller Routes (Protected) */}
              <Route
                path="/catalog"
                element={
                  <ResellerRoute>
                    <Catalog />
                  </ResellerRoute>
                }
              />
              <Route
                path="/catalog/:categorySlug"
                element={
                  <ResellerRoute>
                    <Catalog />
                  </ResellerRoute>
                }
              />
              <Route
                path="/product/:slug"
                element={
                  <ResellerRoute>
                    <ProductDetail />
                  </ResellerRoute>
                }
              />
              <Route
                path="/cart"
                element={
                  <ResellerRoute>
                    <Cart />
                  </ResellerRoute>
                }
              />
              <Route
                path="/order-success/:id"
                element={
                  <ResellerRoute>
                    <OrderSuccess />
                  </ResellerRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ResellerRoute>
                    <Orders />
                  </ResellerRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ResellerRoute>
                    <Account />
                  </ResellerRoute>
                }
              />

              {/* Admin & Staff Admin Routes (Permission-Guarded) */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <RequirePermission perm="dashboard.view">
                      <AdminDashboard />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/products"
                element={
                  <AdminRoute>
                    <RequirePermission perm="products.view">
                      <AdminProductsList />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/products/new"
                element={
                  <AdminRoute>
                    <RequirePermission perm="products.create">
                      <AdminProductForm />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/products/:id"
                element={
                  <AdminRoute>
                    <RequirePermission perm="products.view">
                      <AdminProductForm />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <AdminRoute>
                    <RequirePermission perm="categories.view">
                      <AdminCategoriesList />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/resellers"
                element={
                  <AdminRoute>
                    <RequirePermission perm="resellers.view">
                      <AdminResellersList />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/resellers/new"
                element={
                  <AdminRoute>
                    <RequirePermission perm="resellers.create">
                      <AdminResellerNew />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/resellers/:id"
                element={
                  <AdminRoute>
                    <RequirePermission perm="resellers.view">
                      <AdminResellerDetail />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <AdminRoute>
                    <RequirePermission perm="orders.view">
                      <AdminOrdersList />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <AdminRoute>
                    <RequirePermission perm="settings.view">
                      <AdminSettings />
                    </RequirePermission>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/team"
                element={
                  <AdminRoute>
                    <RequireSuperAdmin>
                      <AdminTeamList />
                    </RequireSuperAdmin>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/activity"
                element={
                  <AdminRoute>
                    <RequireSuperAdmin>
                      <AdminActivityLog />
                    </RequireSuperAdmin>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/no-access"
                element={
                  <AdminRoute>
                    <NoAccess />
                  </AdminRoute>
                }
              />

                {/* In-App 404 Catch-All */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </PermissionsProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
