import { personalDataApi } from "../store/personalDataApi";
import { ToastProvider } from "../context/ToastContext";
import { StandaloneShowcase } from "./StandaloneShowcase";
import { store as baseStore } from "../store";
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { PageData } from '../../../shared/seo/metadata';
import MainLanding from '../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Landing';
import ClubLanding from '../LandingPages/Main-Landing-Pages/Club-Account-Landing-Pages/Landing';
import PlatformPage from '../LandingPages/Platform/Landing';
import { Card } from '../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Card';
import { Platform } from '../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Platform';
import { Events } from '../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Events';
import BlogCollectionPage from '../LandingPages/Blog/BlogCollectionPage';
import BlogLanding from '../LandingPages/Blog/Landing';
import DocsHubPage from '../LandingPages/Docs/DocsHubPage';
import DocsViewerPage from '../LandingPages/Docs/DocsViewerPage';
import PrivacyPage from '../LandingPages/Legal/PrivacyPolicyPage';
import TermsPage from '../LandingPages/Legal/TermsConditionsPage';
import ClubPage from '../app/Club/PublicClubProfilePage';
import AboutPage from './PublicAnswers';
import PublicEventPage from './PublicEventPage';
import EventsIndex from './EventsIndex';

/** Anonymous request-local state only. Never hydrate HTML with a logged-in user's Redux state. */
export function renderPublicPage(path: string, data: PageData = {}): Promise<string> {
    const initial = baseStore.getState();
    const store = configureStore({ reducer: () => ({ ...initial, user: { ...initial.user, user: null, loading: false, isAuthenticated: false } }), middleware: getDefault => getDefault().concat(personalDataApi.middleware) });
    const tree = <Provider store={store}><ToastProvider><StaticRouter location={path}><Routes>
        <Route path="/" element={<MainLanding />} /><Route path="/clubs" element={<ClubLanding initialData={data} />} />
        <Route path="/platform" element={<PlatformPage />} /><Route path="/card" element={<StandaloneShowcase path="/card"><Card /></StandaloneShowcase>} />
        <Route path="/platforms" element={<StandaloneShowcase path="/platforms"><Platform /></StandaloneShowcase>} /><Route path="/events-showcase" element={<StandaloneShowcase path="/events-showcase"><Events /></StandaloneShowcase>} />
        <Route path="/blogs" element={<BlogCollectionPage />} /><Route path="/blog/:hoster/:blogName" element={<BlogLanding />} /><Route path="/blog/:hoster/:blogName/:pageId" element={<BlogLanding />} />
        <Route path="/docs" element={<DocsHubPage />} /><Route path="/docs/:slug" element={<DocsViewerPage />} />
        <Route path="/privacy" element={<PrivacyPage />} /><Route path="/terms" element={<TermsPage />} /><Route path="/about" element={<AboutPage />} />
        <Route path="/clubs/:slug" element={<ClubPage initialClubData={data.entity?.club} />} />
        <Route path="/events" element={<EventsIndex initialData={data} />} /><Route path="/events/:eventId" element={<PublicEventPage initialData={data} />} />
    </Routes></StaticRouter></ToastProvider></Provider>;
    return new Promise((resolve,reject) => {
        const output = new PassThrough();
        let html = '';
        let renderError: unknown;
        const timer = setTimeout(() => { stream.abort(); reject(new Error('Public render timed out')); }, 10000);
        output.on('data', chunk => { html += chunk.toString(); });
        output.on('end', () => { clearTimeout(timer); resolve(html); });
        output.on('error', error => { clearTimeout(timer); reject(error); });
        const stream = renderToPipeableStream(tree, {
            onError(error) { renderError = error; },
            onShellError(error) { clearTimeout(timer); reject(error); },
            onAllReady() { if (renderError) { clearTimeout(timer); reject(renderError); } else stream.pipe(output); },
        });
    });
}
