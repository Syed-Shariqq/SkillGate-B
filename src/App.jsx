import { useEffect } from "react";
import * as authService from "./services/auth/authService";

function App() {

  useEffect(() => {
    const runTest = async () => {
      console.log("===== AUTH SERVICE TEST START =====");

      const email = "test123@gmail.com";
      const password = "password123";

      // 1. REGISTER
      const registerRes = await authService.register({
        name: "Test User",
        email,
        password,
      });
      console.log("REGISTER:", registerRes);

      // 2. LOGIN
      const loginRes = await authService.login({
        email,
        password,
      });
      console.log("LOGIN:", loginRes);

      // 3. GET USER
      const user = await authService.getCurrentUser();
      console.log("USER:", user);

      // 4. GET PROFILE
      if (user) {
        const profileRes = await authService.getProfile(user.id);
        console.log("PROFILE:", profileRes);
      }

      console.log("===== AUTH SERVICE TEST END =====");
    };

    runTest();
  }, []);

  return <div>Testing Auth...</div>;
}

export default App;