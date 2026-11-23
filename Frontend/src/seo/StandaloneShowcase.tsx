import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { STATIC_PAGES } from '../../../shared/seo/routes';
export function StandaloneShowcase({ path, children }: { path: string; children: ReactNode }) {
    const page = STATIC_PAGES.find(item => item.path === path);
    return <main className="bg-[#FAF6EE] min-h-screen"><header className="max-w-6xl mx-auto px-5 pt-12 space-y-4"><Link to="/">Orbix home</Link><h1 className="text-3xl font-black">{page?.title.split(' | ')[0]}</h1><p>{page?.description}</p></header>{children}</main>;
}
