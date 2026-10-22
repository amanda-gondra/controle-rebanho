import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
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
import { NotFound } from "./pages/NotFound.js";
import { ScreenError } from "./pages/ScreenError.js";
import { TradeList } from "./pages/TradeList.js";
import { TradeCreate } from "./pages/TradeCreate.js";
import { TradeDetail } from "./pages/TradeDetail.js";
import { TradeEdit } from "./pages/TradeEdit.js";
import { LotList } from "./pages/LotList.js";
import { LotDetail } from "./pages/LotDetail.js";
import { WeighingSession } from "./pages/WeighingSession.js";
import { Dashboard } from "./pages/Dashboard.js";
import { ToastProvider } from "./components/ToastProvider.js";
import { AuthProvider } from "./components/AuthProvider.js";
import { RedirectIfLoggedIn, RequireAuth } from "./components/RequireAuth.js";

// Roteador "de dados" do React Router: necessário para avisar antes de sair
// de um formulário com alterações não salvas (useBlocker — navigation/).
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<ScreenError />}>
      {/* Públicas: entrar e criar conta */}
      <Route element={<RedirectIfLoggedIn />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Todo o resto exige login */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<AnimalList />} />
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/pesagens" element={<WeighingSession />} />
        <Route path="/lotes" element={<LotList />} />
        <Route path="/lotes/:id" element={<LotDetail />} />
        <Route path="/animais/novo" element={<AnimalCreate />} />
        <Route path="/animais/:id" element={<AnimalDetail />} />
        <Route path="/animais/:id/editar" element={<AnimalEdit />} />
        <Route path="/manejo" element={<Sanitary />} />
        <Route path="/produtos" element={<Products />} />
        <Route path="/aplicacoes/nova" element={<ApplicationCreate />} />
        <Route path="/aplicacoes/:id" element={<ApplicationDetail />} />
        <Route path="/negociacoes" element={<TradeList />} />
        <Route path="/negociacoes/nova" element={<TradeCreate />} />
        <Route path="/negociacoes/:id" element={<TradeDetail />} />
        <Route path="/negociacoes/:id/editar" element={<TradeEdit />} />
        <Route path="/configuracoes" element={<Settings />} />
        {/* Endereço que não existe: tela própria, com caminho de volta */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>,
  ),
);

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
