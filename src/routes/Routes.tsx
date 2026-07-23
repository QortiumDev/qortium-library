import { useEffect, useRef } from 'react';
import { createHashRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { BrowsePage } from '../pages/BrowsePage';
import { BookDetailPage } from '../pages/BookDetailPage';
import { LibraryPage } from '../pages/LibraryPage';
import { PublishPage } from '../pages/PublishPage';
import { UserPage } from '../pages/UserPage';
import { useIframe } from '../hooks/useIframeListener';

function Layout() {
  const navigate = useNavigate();
  const applied  = useRef(false);
  useIframe();

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const route = new URLSearchParams(window.location.search).get('_route');
    if (route) navigate(route, { replace: true });
  }, [navigate]);

  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,             element: <BrowsePage />  },
      { path: 'publish',         element: <PublishPage /> },
      { path: 'library',         element: <LibraryPage /> },
      { path: 'user/:name',      element: <UserPage />    },
      { path: 'book/:name/:identifier', element: <BookDetailPage /> },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
