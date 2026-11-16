import { useEffect } from 'react';
import { Toasts } from './components/ui';
import { AppProvider } from './lib/app';
import { useRoute } from './lib/router';
import BagPage from './pages/BagPage';
import BookPage from './pages/BookPage';
import CatalogPage from './pages/CatalogPage';
import ProductPage from './pages/ProductPage';

function Routes() {
  const route = useRoute();
  const key = route.name === 'product' ? `p:${route.id}` : route.name;

  // Each new screen starts at the top; returning home keeps the browser's own scroll memory.
  useEffect(() => {
    if (route.name !== 'home') window.scrollTo({ top: 0, behavior: 'instant' });
    if (route.name === 'home') document.title = 'Atelier Solis · គ្រឿងសង្ហារិមខ្មែរ · Made-to-measure Khmer furniture';
    if (route.name === 'bag') document.title = 'Bag · Atelier Solis';
  }, [key, route.name]);

  if (route.name === 'product') return <ProductPage key={key} id={route.id} query={route.query} />;
  if (route.name === 'bag') return <BagPage />;
  if (route.name === 'book') return <BookPage key={key} query={route.query} />;
  return <CatalogPage />;
}

export default function App() {
  return (
    <AppProvider>
      <Routes />
      <Toasts />
    </AppProvider>
  );
}
