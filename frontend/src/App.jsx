import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { Button } from 'react-aria-components';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-96 text-center">
                    <h1 className="text-4xl font-bold mb-4">mirpass</h1>
                    <p className="mb-8">access_granted</p>
                    
                    <p className="mb-10 text-lg">Welcome back, Operator.</p>
                    
                    <Button 
                        className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 cursor-pointer"
                        onPress={() => { localStorage.removeItem('token'); window.location.reload(); }}
                    >
                        TERMINATE SESSION
                    </Button>
                </div>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App
