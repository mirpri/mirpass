import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Form, TextField, Label, Input, Button, FieldError } from 'react-aria-components';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/register', { username, email, password });
            setSuccess(res.data.message);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
            setSuccess('');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="w-96">
                <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                {success ? (
                    <div className="text-center">
                        <p className="text-green-500 mb-4">{success}</p>
                        <Link to="/login" className="text-blue-600 hover:underline">Go to Login</Link>
                    </div>
                ) : (
                    <>
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
                                name="email" 
                                value={email} 
                                onChange={setEmail} 
                                isRequired 
                                type="email"
                                className="mb-4 flex flex-col"
                            >
                                <Label className="mb-1">Email</Label>
                                <Input type="email" className="border p-2 rounded" />
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
                                Register
                            </Button>
                        </Form>
                        <p className="mt-4 text-center">
                            Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default Register;
