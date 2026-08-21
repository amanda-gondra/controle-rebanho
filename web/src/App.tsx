import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimalList } from "./pages/AnimalList.js";
import { AnimalCreate } from "./pages/AnimalCreate.js";
import { AnimalDetail } from "./pages/AnimalDetail.js";
import { AnimalEdit } from "./pages/AnimalEdit.js";
import { ToastProvider } from "./components/ToastProvider.js";

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AnimalList />} />
          <Route path="/animais/novo" element={<AnimalCreate />} />
          <Route path="/animais/:id" element={<AnimalDetail />} />
          <Route path="/animais/:id/editar" element={<AnimalEdit />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;