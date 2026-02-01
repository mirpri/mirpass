import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, TextField, Label, Input, Button, FieldError } from 'react-aria-components';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('verified') === 'true') {
            setInfo('Email verified successfully! You can now log in.');
        }
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/login', { username, password });
            localStorage.setItem('token', res.data.data.token);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="w-96">
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {info && <p className="text-green-500 mb-4">{info}</p>}
                <Form onSubmit={handleSubmit}>
                    <TextField 
                        name="username" 
                        value={username} 
                        onChange={setUsername} 
                        isRequired 
                        className="mb-4 flex flex-col"
                    >
                        <Label className="mb-1">Username</Label>
                        <Input className="border p-2 rounded" />
                        <FieldError className="text-red-500 text-sm" />
                    </TextField>
                    <TextField 
                        name="password" 
                        value={password} 
                        onChange={setPassword} 
                        isRequired 
                        className="mb-6 flex flex-col"
                    >
                        <Label className="mb-1">Password</Label>
                        <Input type="password" className="border p-2 rounded" />
                        <FieldError className="text-red-500 text-sm" />
                    </TextField>
                    <Button
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 cursor-pointer"
                        type="submit"
                    >
                        Login
                    </Button>
                </Form>
                <p className="mt-4 text-center">
                    Don't have an account? <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
