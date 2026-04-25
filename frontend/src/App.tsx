import { NavLink, Route, Routes } from 'react-router-dom';
import { Shield } from 'lucide-react';

import DeepLinkModal from './components/DeepLinkModal';
import { modalSpecs, navLinks } from './lib/siteContent';
import AdaptiveDeliveryPage from './pages/AdaptiveDeliveryPage';
import ExamPracticePage from './pages/ExamPracticePage';
import MockExamResultPage from './pages/MockExamResultPage';
import MockExamSessionPage from './pages/MockExamSessionPage';
import OverviewPage from './pages/OverviewPage';
import RoleplayPage from './pages/RoleplayPage';
import TextTutorPage from './pages/TextTutorPage';

function App() {
  return (
    <div className="site-bg">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="top-nav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Shield size={18} />
          </span>
          <div>
            <p className="brand-title">SecurePass</p>
            <p className="brand-subtitle">Security guard training UI</p>
          </div>
        </div>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  end={link.to === '/'}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main-content" className="app-shell">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/text-tutor" element={<TextTutorPage />} />
          <Route path="/exam-practice" element={<ExamPracticePage />} />
          <Route path="/exam-practice/mock/:examId" element={<MockExamSessionPage />} />
          <Route path="/exam-practice/results/:resultId" element={<MockExamResultPage />} />
          <Route path="/roleplay" element={<RoleplayPage />} />
          <Route path="/adaptive-delivery" element={<AdaptiveDeliveryPage />} />
        </Routes>
      </main>

      <DeepLinkModal specs={modalSpecs} />
    </div>
  );
}

export default App;
