FROM golang:latest AS builder
WORKDIR /app
COPY go.mod go.sum ./
ENV GOPROXY=https://goproxy.cn
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main .


FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .
# COPY .env .
EXPOSE 8080
CMD ["./main"]

# docker build --platform linux/amd64 -t mirpri/mirpass:v0.1 .