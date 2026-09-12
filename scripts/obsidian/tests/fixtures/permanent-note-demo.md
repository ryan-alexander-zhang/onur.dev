---
tags:
  - distributed-system
  - consistency
id: 20260625165618
created: 2026-06-25 16:56:18
updated: 2026-06-25 16:56:18
type: permanent-note
aliases:
  - Distributed System 中的 Strong Consistency 往往要牺牲 Availability 或 Low Latency
  - Strong consistency in distributed systems often sacrifices availability or low latency
  - 分布式系统中的高一致性通常要用可用性或延迟来支付成本
  - 分布式系统高一致性必然以可用性或性能为代价
  - PACELC
  - 一致性的代价
---

# 分布式系统中的强一致性往往要牺牲可用性或低延迟

这里的 Strong Consistency 特指 CAP/PACELC 中的 Atomic Consistency。发生 Network Partition 时，无法获得足够 Replica 确认的一侧必须拒绝 Write Request，牺牲 Availability。网络正常时，Write Request 仍要等待 Replica 同步或 Quorum 确认，Read Path 也不能任意返回 Lagging Replica 的数据。这些 Coordination 增加了 Request Latency。

## English

Strong consistency here refers specifically to atomic consistency in CAP/PACELC. During a network partition, a side that cannot gather enough replica acknowledgements must reject write requests, sacrificing availability. When network communication is healthy, write requests still have to wait for replica synchronization or quorum acknowledgement, and the read path cannot return data from lagging replicas without additional coordination. This coordination increases request latency.

## 来源

- [[20260624213544-Apache Kafka 架构、核心概念与数据模型|Apache Kafka 架构、核心概念与数据模型]]，Replication / ISR 与 Q3。
- Daniel J. Abadi，[Consistency Tradeoffs in Modern Distributed Database System Design](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf)。
