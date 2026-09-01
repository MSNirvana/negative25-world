import { createRouter, createWebHistory } from 'vue-router';
import GalleryView from './views/GalleryView.vue';
import PhotoView from './views/PhotoView.vue';
import DiscoverView from './views/DiscoverView.vue';
import AdminLayout from './views/admin/AdminLayout.vue';
import AdminDashboardView from './views/admin/AdminDashboardView.vue';
import AdminImportsView from './views/admin/AdminImportsView.vue';
import AdminPhotosView from './views/admin/AdminPhotosView.vue';
import AdminSettingsView from './views/admin/AdminSettingsView.vue';
import AdminLoginView from './views/admin/AdminLoginView.vue';
import AlbumsView from './views/AlbumsView.vue';
import AlbumView from './views/AlbumView.vue';
import AboutView from './views/AboutView.vue';
import AdminAlbumsView from './views/admin/AdminAlbumsView.vue';
import AdminProfileView from './views/admin/AdminProfileView.vue';
import PublicProfileView from './views/PublicProfileView.vue';
import AuthRegisterView from './views/AuthRegisterView.vue';
import { isApiConfigured } from './api/client';

function requireAdminSession(to: { fullPath: string }): true | { name: string; query: { redirect: string } } {
  if (!isApiConfigured() || (typeof window !== 'undefined' && window.localStorage.getItem('negative25.session'))) return true;
  return { name: 'auth-login', query: { redirect: to.fullPath } };
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'gallery', component: GalleryView },
    { path: '/discover', name: 'discover', component: DiscoverView },
    { path: '/discover/:slug', name: 'discover-place', component: DiscoverView, props: true },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/albums', name: 'albums', component: AlbumsView },
    { path: '/album/:id', name: 'album', component: AlbumView, props: true },
    { path: '/auth/login', name: 'auth-login', component: AdminLoginView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    { path: '/auth/register', name: 'auth-register', component: AuthRegisterView },
    { path: '/account', component: AdminLayout, beforeEnter: requireAdminSession, children: [
      { path: '', name: 'account-dashboard', component: AdminDashboardView },
      { path: 'imports', name: 'account-imports', component: AdminImportsView },
      { path: 'photos', name: 'account-photos', component: AdminPhotosView },
      { path: 'albums', name: 'account-albums', component: AdminAlbumsView },
      { path: 'profile', name: 'account-profile', component: AdminProfileView },
      { path: 'settings', name: 'account-settings', component: AdminSettingsView },
    ] },
    { path: '/admin', redirect: '/account' },
    { path: '/photo/:id', name: 'photo', component: PhotoView, props: true },
    { path: '/@:username', name: 'public-profile', component: PublicProfileView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
