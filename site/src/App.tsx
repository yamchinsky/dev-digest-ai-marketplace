import { useEffect, type ReactElement } from 'react';
import { Layout } from './components/Layout';
import { useHashRoute } from './lib/router';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { PluginPage } from './pages/PluginPage';
import { ArtifactPage } from './pages/ArtifactPage';
import { WhatsNewPage } from './pages/WhatsNewPage';
import { GettingStartedPage } from './pages/GettingStartedPage';

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  let page: ReactElement;
  switch (route.name) {
    case 'search':
      page = <SearchPage q={route.q} type={route.type} />;
      break;
    case 'plugin':
      page = <PluginPage name={route.plugin} />;
      break;
    case 'artifact':
      page = <ArtifactPage plugin={route.plugin} artifact={route.artifact} />;
      break;
    case 'whats-new':
      page = <WhatsNewPage />;
      break;
    case 'getting-started':
      page = <GettingStartedPage />;
      break;
    default:
      page = <HomePage />;
  }

  return <Layout>{page}</Layout>;
}
