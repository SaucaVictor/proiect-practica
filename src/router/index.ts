import { createRouter, createWebHistory } from 'vue-router'
import { requireAuth, requireGuest } from './guards'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Auth routes ───────────────────────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      beforeEnter: requireGuest,
      meta: { layout: 'auth' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/RegisterPage.vue'),
      beforeEnter: requireGuest,
      meta: { layout: 'auth' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/pages/ForgotPasswordPage.vue'),
      beforeEnter: requireGuest,
      meta: { layout: 'auth' },
    },
    // ── App routes ────────────────────────────────────────────────────────────
    {
      path: '/',
      name: 'home',
      redirect: { name: 'chat' },
      beforeEnter: requireAuth,
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/pages/ChatPage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/chat/:id',
      name: 'chat-conversation',
      component: () => import('@/pages/ChatPage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/SettingsPage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/pages/ProfilePage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: () => import('@/pages/WorkspacePage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/iot',
      name: 'iot',
      component: () => import('@/pages/IoTPage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/audio-call',
      name: 'audio-call',
      component: () => import('@/pages/AudioCallPage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: () => import('@/pages/SchedulePage.vue'),
      beforeEnter: requireAuth,
      meta: { layout: 'app' },
    },
    // ── 404 ──────────────────────────────────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { layout: 'none' },
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

export default router
