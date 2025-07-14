# Tritongaming.org api documentation

---

## Public Apis

<details>
 <summary><code>GET</code> <code><b>/</b></code></summary>

##### Responses

> | code  | content-type       | response                      |
> | ----- | ------------------ | ----------------------------- |
> | `200` | `text/html` | `Home Page .html` |

</details>

<!-- <details>
 <summary><code>GET</code> <code><b>/</b>api<b>/</b></code></summary>

##### Responses

> | code  | content-type       | response                      |
> | ----- | ------------------ | ----------------------------- |
> | `200` | `application/json` | `Array with JSON of all orgs` |

</details> -->

<details>
    <summary>
    <code>GET</code>
    <code><b>/</b>api<b>/</b>event</code>
</summary>

##### Path Variables & Request Parameters

> | name | type         | required?  | default | data type | description       |
> | ---- | ------------ | --------- | ----- | --------- | ----------------- |
> | `id`   | RequestParam | no      | `null` | ObjectID (oid)       | Event's Id |
> | `sort` | RequestParam | no | `DESC` | string | Sort order for the reture JSON |
> | `count` | RequestParam | no | 10 | How many to return |
> | 

##### Responses
```json
{
    "code": 200,
    "message": "",
    "events": [
        {
            "id": "",
            "full_name": "",
            "name": "",
            "start_time": "YYYY-MM-DDThh:mm:ssTZD",
            "end_time": "YYYY-MM-DDThh:mm:ssTZD",
            
        }
    ]
}
```

> | code  | content-type       | response                                   |
> | ----- | ------------------ | ------------------------------------------ |
> | `200` | `application/json` | `JSON of Events Object`              |
> | `404` | `application/json` | `{"code":"404","message":"Event/Events Not Found"}` |

</details>

---

## Private Apis
