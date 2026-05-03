package ma.careplus.identity.infrastructure.web.mapper;

import java.util.Set;
import java.util.stream.Collectors;
import ma.careplus.identity.application.LoginResult;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "roles", source = "roles", qualifiedByName = "rolesToStrings")
    @Mapping(target = "permissions", ignore = true)
    UserView toView(User user);

    @Named("rolesToStrings")
    default Set<String> rolesToStrings(Set<ma.careplus.identity.domain.Role> roles) {
        if (roles == null) return Set.of();
        return roles.stream().map(r -> r.getCode()).collect(Collectors.toSet());
    }

    default UserView fromLoginResult(LoginResult result) {
        return new UserView(result.userId(), result.email(), result.firstName(),
                result.lastName(), result.roles());
    }
}
