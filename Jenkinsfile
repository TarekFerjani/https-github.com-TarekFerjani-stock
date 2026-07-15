pipeline {
    agent any

    environment {
        FRONTEND_IMAGE = "frigo_frontend"
        BACKEND_IMAGE  = "frigo_backend"
        TAG            = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: '3cb747b7-d12e-4b8e-b9b8-d5ea2a0a5058',
                    url: 'https://github.com/TarekFerjani/stock.git'
            }
        }

        stage('Build Backend') {
            steps {
                sh """
                docker build \
                    -t ${BACKEND_IMAGE}:${TAG} \
                    -t ${BACKEND_IMAGE}:latest \
                    ./backend
                """
            }
        }

        stage('Build Frontend') {
            steps {
                sh """
                docker build \
                    -t ${FRONTEND_IMAGE}:${TAG} \
                    -t ${FRONTEND_IMAGE}:latest \
                    .
                """
            }
        }

        stage('Deploy Backend') {
            steps {
                sh """
                docker stop frigo_backend || true
                docker rm frigo_backend || true

                docker run -d \
                    --name frigo_backend \
                    --restart always \
                    --network shared_network \
                    -p 3001:3001 \
                    ${BACKEND_IMAGE}:latest
                """
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh """
                docker stop frigo_frontend || true
                docker rm frigo_frontend || true

                docker run -d \
                    --name frigo_frontend \
                    --restart always \
                    --network shared_network \
                    -p 3000:80 \
                    ${FRONTEND_IMAGE}:latest
                """
            }
        }

        stage('Cleanup') {
            steps {
                sh """
                docker image prune -af
                docker container prune -f
                docker builder prune -af
                """
            }
        }
    }

    post {
        success {
            echo '✅ Déploiement effectué'
        }

        failure {
            echo '❌ Déploiement échoué'
        }
    }
}
