package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.MyTrainingQueryService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/training/me")
public class MyTrainingQueryController {
    private final MyTrainingQueryService queries;
    private final CurrentUserService users;

    public MyTrainingQueryController(MyTrainingQueryService queries, CurrentUserService users) {
        this.queries = queries;
        this.users = users;
    }

    @GetMapping("/{kind}/table")
    public Map<String, Object> list(@PathVariable String kind, @RequestParam Map<String, String> params) {
        return queries.list(users.requireCurrentUser(), kind, params);
    }
}
