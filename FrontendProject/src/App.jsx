import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Завантаження...");

  useEffect(() => {
    // Вкажіть тут порт вашого бекенду (з Swagger)
    fetch("https://localhost:7152/test")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => {
        console.error(err); // Тепер err використано, і помилка зникне
        setMessage("Помилка підключення до API");
      });
  }, []);

  return (
    <div>
      <h1>Habit Tracker</h1>
      <p>Статус API: {message}</p>
    </div>
  );
}

export default App;
