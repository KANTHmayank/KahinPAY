package com.demo.upimesh.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Distributed Idempotency Service.
 *
 * Implements an active-fallback pattern:
 *   1. Distributed mode (Production / Clustered):
 *      Uses Redis SETNX (setIfAbsent) with TTL. This prevents duplicate settlement
 *      even when duplicate bridge uploads hit different backend server replicas.
 *   2. Local fallback mode (Demo / Single-instance / Disconnected):
 *      Uses ConcurrentHashMap.putIfAbsent, providing JVM-local atomic compare-and-set.
 *
 * The contract:
 *   - claim(hash) returns true on first call, false on every call after that
 *     (within the TTL window)
 *   - the operation is strictly atomic.
 */
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);
    private static final String REDIS_KEY_PREFIX = "upi:mesh:idempotency:";

    private final Map<String, Instant> localSeen = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @Value("${upi.mesh.idempotency.use-redis:false}")
    private boolean useRedis;

    @Value("${upi.mesh.idempotency-ttl-seconds:86400}")
    private long ttlSeconds;

    /**
     * Try to claim a hash. Returns true if this caller is the first; false if
     * someone else already claimed it (i.e. the packet is a duplicate).
     */
    public boolean claim(String packetHash) {
        if (useRedis && redisTemplate != null) {
            try {
                String key = REDIS_KEY_PREFIX + packetHash;
                Boolean acquired = redisTemplate.opsForValue()
                        .setIfAbsent(key, Instant.now().toString(), Duration.ofSeconds(ttlSeconds));
                return Boolean.TRUE.equals(acquired);
            } catch (Exception e) {
                log.warn("Redis connection error ({}), failing over to in-memory idempotency", e.getMessage());
                return localClaim(packetHash);
            }
        }
        return localClaim(packetHash);
    }

    private boolean localClaim(String packetHash) {
        Instant now = Instant.now();
        Instant prev = localSeen.putIfAbsent(packetHash, now);
        return prev == null;
    }

    public boolean isUsingRedis() {
        return useRedis && redisTemplate != null;
    }

    public int size() {
        if (useRedis && redisTemplate != null) {
            try {
                Set<String> keys = redisTemplate.keys(REDIS_KEY_PREFIX + "*");
                if (keys != null) return keys.size();
            } catch (Exception ignored) {}
        }
        return localSeen.size();
    }

    /** Periodically evict entries past their TTL from local memory so the map doesn't grow forever. */
    @Scheduled(fixedDelay = 60_000)
    public void evictExpired() {
        Instant cutoff = Instant.now().minusSeconds(ttlSeconds);
        localSeen.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
    }

    /** Test/demo helper to clear the cache. */
    public void clear() {
        localSeen.clear();
        if (useRedis && redisTemplate != null) {
            try {
                Set<String> keys = redisTemplate.keys(REDIS_KEY_PREFIX + "*");
                if (keys != null && !keys.isEmpty()) {
                    redisTemplate.delete(keys);
                }
            } catch (Exception ignored) {}
        }
    }
}
