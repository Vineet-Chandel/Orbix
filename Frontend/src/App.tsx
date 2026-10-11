import { BrowserRouter, Routes, Route } from "react-router-dom";
import SignInPage from './LandingPages/Auth-Pages/Signin/Landing';
import SignUpPage from './LandingPages/Auth-Pages/Signup/Landing';
const App = () => {
  return (

    <BrowserRouter>
      <Routes>

        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App