import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import PublicProfilePage from "./pages/PublicProfilePage";
import RegisterPage from "./pages/RegisterPage";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import TripInvitationsPage from "./pages/TripInvitationsPage";
import CompanionsPage from "./pages/CompanionsPage";
import ExplorePage from "./pages/ExplorePage";

function App() {
  const token = localStorage.getItem("token");

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={token ? "/home" : "/login"}
              replace
            />
          }
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users/:userId"
          element={
            <ProtectedRoute>
              <PublicProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trips"
          element={
            <ProtectedRoute>
              <TripsPage />
            </ProtectedRoute>
          }
        />
       <Route
         path="/trips/:tripId"
          element={
            <ProtectedRoute>
             <TripDetailPage />
            </ProtectedRoute>
         }
       />
       <Route
        path="/trip-invitations"
         element={
           <ProtectedRoute>
              <TripInvitationsPage />
           </ProtectedRoute>
             }
         />
        <Route
          path="/companions"
          element={
            <ProtectedRoute>
              <CompanionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <Navigate to="/explore" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;