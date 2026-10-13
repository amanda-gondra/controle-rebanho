import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimalList } from "./pages/AnimalList.js";
import { AnimalCreate } from "./pages/AnimalCreate.js";
import { AnimalDetail } from "./pages/AnimalDetail.js";
import { AnimalEdit } from "./pages/AnimalEdit.js";
import { Products } from "./pages/Products.js";
import { ApplicationCreate } from "./pages/ApplicationCreate.js";
import { ApplicationDetail } from "./pages/ApplicationDetail.js";
import { Sanitary } from "./pages/Sanitary.js";
import { Login } from "./pages/Login.js";
import { Register } from "./pages/Register.js";
import { Settings } from "./pages/Settings.js";
import { ToastProvider } from "./components/ToastProvider.js";
import { AuthProvider } from "./components/AuthProvider.js";
import { RedirectIfLoggedIn, RequireAuth } from "./components/RequireAuth.js";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Públicas: entrar e criar conta */}
            <Route element={<RedirectIfLoggedIn />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Todo o resto exige login */}
            <Route element={<RequireAuth />}>
              <Route path="/" element={<AnimalList />} />
              <Route path="/animais/novo" element={<AnimalCreate />} />
              <Route path="/animais/:id" element={<AnimalDetail />} />
              <Route path="/animais/:id/editar" element={<AnimalEdit />} />
              <Route path="/manejo" element={<Sanitary />} />
              <Route path="/produtos" element={<Products />} />
              <Route path="/aplicacoes/nova" element={<ApplicationCreate />} />
              <Route path="/aplicacoes/:id" element={<ApplicationDetail />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
