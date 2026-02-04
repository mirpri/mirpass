import { useEffect, useRef, useState } from 'react'
import { Button, Card, Flex, Result, Spin, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'

type VerifyResponse = {
  status: number
  message?: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

function VerifyPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg('Missing verification token')
      return
    }

    const verify = async () => {
      setStatus('loading')
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // slight delay for UX
        const { data } = await api.get<VerifyResponse>(`/verify?token=${token}`, {
          headers: { Accept: 'application/json' },
        })
        message.success(data?.message || 'Email verified')
        setStatus('success')
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } }
        setErrorMsg(error.response?.data?.message || 'Verification failed or token expired')
        setStatus('error')
      }
    }

    verify()
  }, [navigate, searchParams])

  const content = () => {
    if (status === 'loading' || status === 'idle') {
      return (
        <Result
          status="info"
          title="Verifying your email"
          subTitle="Please wait a moment"
          extra={<Spin size="large" />}
        />
      )
    }

    if (status === 'success') {
      return (
        <Result
          status="success"
          title="Email verified"
          subTitle="You can now sign in"
          extra={
            <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
              Go to login
            </Button>
          }
        />
      )
    }

    return (
      <Result
        status="error"
        title="Verification failed"
        subTitle={errorMsg || 'The verification link is invalid or expired.'}
        extra={
          <Button type="primary" onClick={() => navigate('/register')}>
            Back to register
          </Button>
        }
      />
    )
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ maxWidth: 640, width: '100%', boxShadow: '0 20px 80px rgba(0,0,0,0.12)' }}>
        {content()}
      </Card>
    </Flex>
  )
}

export default VerifyPage
