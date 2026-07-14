FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install Python 3 and Node.js
RUN dnf install -y python3 python3-pip nodejs bash && dnf clean all

# Copy the executor server
COPY server.py /app/server.py

WORKDIR /app

# The server listens on port 8080 (Lambda MicroVMs default)
EXPOSE 8080

CMD ["python3", "/app/server.py"]
