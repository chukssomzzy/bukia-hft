local failKey = KEYS[1]
local lockKey = KEYS[2]
local threshold = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local lockSeconds = tonumber(ARGV[3])

local ttl = redis.call("ttl", lockKey)
if ttl and ttl > 0 then
	return { 1, ttl }
end

local fails = redis.call("incr", failKey)
if fails == 1 then
	redis.call("expire", failKey, window)
end
if fails >= threshold then
	local setRes = redis.call("set", lockKey, "1", "EX", lockSeconds, "NX")
	if setRes then
		return { 2, lockSeconds }
	else
		local ttl2 = redis.call("ttl", lockKey)
		return { 1, ttl2 }
	end
end

return { 0, fails }
