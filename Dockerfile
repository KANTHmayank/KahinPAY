# ==============================================================================
# KahinPAY — Multi-Stage Production Dockerfile
# Enables one-click deployment on Render, Railway, Fly.io, or Koyeb
# ==============================================================================

# Stage 1: Build the Spring Boot JAR
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy dependency specifications first for Docker layer caching
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .

# Copy source code and build production package
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal JRE Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Run as non-root user for security best practices
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["java", "-jar", "app.jar"]
