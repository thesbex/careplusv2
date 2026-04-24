package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import ma.careplus.identity.application.UserService;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.identity.infrastructure.web.mapper.UserMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "identity", description = "User endpoints")
public class UserController {

    private final UserService userService;
    private final UserMapper userMapper;

    public UserController(UserService userService, UserMapper userMapper) {
        this.userService = userService;
        this.userMapper = userMapper;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserView> me(Authentication authentication) {
        User user = userService.getCurrentUser(authentication);
        return ResponseEntity.ok(userMapper.toView(user));
    }
}
